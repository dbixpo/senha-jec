"""Sobe o Senha JEC no Postgres local, sem tocar no Supabase de produção.

Uso: python tools/servidor_local.py
Abre http://127.0.0.1:8765/
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import psycopg2
import psycopg2.extras
from flask import Flask, Response, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "manutencao.env"
TABELAS = {
    "setores",
    "operadores",
    "servicos",
    "tipos_atendimento",
    "senhas",
    "historico_chamadas",
    "configuracoes",
    "painel_chamadas",
    "painel_imagens",
}
FUNCOES = {
    "login_operador",
    "criar_operador",
    "definir_senha_operador",
    "chamar_senha",
    "chamar_proxima",
    "finalizar_senha",
    "liberar_senha",
    "nao_respondeu_senha",
    "reservar_numero",
}
IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")
FILTRO = re.compile(r"^(eq|neq|gt|gte|lt|lte|like|ilike)\.(.*)$", re.DOTALL)
OPS = {
    "eq": "=",
    "neq": "<>",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
    "like": "like",
    "ilike": "ilike",
}


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


ENV = load_env(ENV_FILE)
psycopg2.extras.register_default_json(loads=json.loads)
psycopg2.extras.register_default_jsonb(loads=json.loads)

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


def db():
    return psycopg2.connect(
        host=ENV.get("LOCAL_DB_HOST", "127.0.0.1"),
        port=int(ENV.get("LOCAL_DB_PORT", "5432")),
        user=ENV.get("LOCAL_DB_USER", "sa"),
        password=ENV.get("LOCAL_DB_PASSWORD", ""),
        dbname=ENV.get("LOCAL_DB_NAME", "senha_jec"),
    )


def json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def json_resp(payload, status=200, extra_headers=None):
    body = json.dumps(payload, default=json_default, ensure_ascii=False)
    resp = Response(body, status=status, mimetype="application/json")
    if extra_headers:
        for k, v in extra_headers.items():
            resp.headers[k] = v
    return resp


def colunas(cur, tabela: str) -> set[str]:
    cur.execute(
        """
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = %s
        """,
        (tabela,),
    )
    return {r["column_name"] for r in cur.fetchall()}


def parse_select(raw: str | None, cols: set[str]) -> list[str]:
    if not raw or raw.strip() == "*":
        return ["*"]
    saida = []
    for parte in raw.split(","):
        nome = parte.strip()
        if nome in cols and IDENT.match(nome):
            saida.append(nome)
    return saida or ["*"]


def parse_filtros(args, cols: set[str]):
    clauses = []
    params = []
    for key in args:
        if key in {"select", "order", "limit", "offset"}:
            continue
        if key not in cols or not IDENT.match(key):
            continue
        for raw in args.getlist(key):
            m = FILTRO.match(raw)
            if not m:
                continue
            op, valor = m.group(1), m.group(2)
            clauses.append(f"{key} {OPS[op]} %s")
            params.append(valor)
    return clauses, params


def parse_order(raw_list, cols: set[str]) -> str:
    pedacos = []
    for raw in raw_list:
        for parte in raw.split(","):
            parte = parte.strip()
            if not parte:
                continue
            if "." in parte:
                col, direcao = parte.split(".", 1)
            else:
                col, direcao = parte, "asc"
            if col not in cols or not IDENT.match(col):
                continue
            direcao = "desc" if direcao.lower().startswith("desc") else "asc"
            pedacos.append(f"{col} {direcao}")
    return (" order by " + ", ".join(pedacos)) if pedacos else ""


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = request.headers.get(
        "Access-Control-Request-Headers", "*"
    )
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    resp.headers["Access-Control-Expose-Headers"] = "Content-Range,Content-Profile,Prefer"
    return resp


@app.route("/rest/v1/<tabela>", methods=["OPTIONS"])
@app.route("/rest/v1/rpc/<funcao>", methods=["OPTIONS"])
def preflight(tabela=None, funcao=None):
    return ("", 204)


@app.route("/rest/v1/rpc/<funcao>", methods=["POST"])
def rpc(funcao):
    if funcao not in FUNCOES:
        return jsonify({"message": f"função {funcao} não existe"}), 404
    payload = request.get_json(silent=True) or {}
    nomes = [k for k in payload if IDENT.match(k)]
    args_sql = ", ".join(f"{n} := %s" for n in nomes)
    sql = f"select {funcao}({args_sql})" if nomes else f"select {funcao}()"
    valores = [payload[n] for n in nomes]
    conn = db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, valores)
                row = cur.fetchone()
        dado = row[0] if row else None
        return json_resp(dado)
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"message": e.pgerror or str(e), "code": e.pgcode}), 400
    finally:
        conn.close()


@app.route("/rest/v1/<tabela>", methods=["GET", "POST", "PATCH", "DELETE"])
def tabela_rest(tabela):
    if tabela not in TABELAS:
        return jsonify({"message": "tabela desconhecida"}), 404
    conn = db()
    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cols = colunas(cur, tabela)
                if request.method == "GET":
                    return get_tabela(cur, tabela, cols)
                if request.method == "POST":
                    return post_tabela(cur, tabela, cols)
                if request.method == "DELETE":
                    return delete_tabela(cur, tabela, cols)
                return patch_tabela(cur, tabela, cols)
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"message": e.pgerror or str(e), "code": e.pgcode}), 400
    finally:
        conn.close()


def get_tabela(cur, tabela, cols):
    select = parse_select(request.args.get("select"), cols)
    campos = "*" if select == ["*"] else ", ".join(select)
    clauses, params = parse_filtros(request.args, cols)
    where = (" where " + " and ".join(clauses)) if clauses else ""
    order = parse_order(request.args.getlist("order"), cols)
    cur.execute(f"select count(*) from {tabela}{where}", params)
    total = cur.fetchone()["count"]
    range_hdr = request.headers.get("Range") or request.headers.get("range") or ""
    de, ate = 0, 999
    if "-" in range_hdr:
        a, b = range_hdr.split("-", 1)
        try:
            de = int(a)
            ate = int(b)
        except ValueError:
            pass
    if request.args.get("offset"):
        try:
            de = int(request.args.get("offset"))
        except ValueError:
            pass
    if request.args.get("limit"):
        try:
            ate = de + int(request.args.get("limit")) - 1
        except ValueError:
            pass
    limit = ate - de + 1
    cur.execute(
        f"select {campos} from {tabela}{where}{order} offset %s limit %s",
        [*params, de, limit],
    )
    rows = list(cur.fetchall())
    fim = de + len(rows) - 1 if rows else de
    headers = {"Content-Range": f"{de}-{fim}/{total}", "Content-Type": "application/json"}
    return json_resp(rows, extra_headers=headers)


def post_tabela(cur, tabela, cols):
    payload = request.get_json(silent=True) or {}
    if isinstance(payload, list):
        linhas = payload
    else:
        linhas = [payload]
    inseridos = []
    for linha in linhas:
        campos = [k for k in linha if k in cols and IDENT.match(k)]
        if not campos:
            continue
        placeholders = ", ".join(["%s"] * len(campos))
        sql = f"insert into {tabela} ({', '.join(campos)}) values ({placeholders}) returning *"
        cur.execute(sql, [linha[c] for c in campos])
        inseridos.append(dict(cur.fetchone()))
    prefer = (request.headers.get("Prefer") or "").lower()
    if "return=representation" in prefer:
        return json_resp(inseridos if isinstance(payload, list) else inseridos[0] if inseridos else {})
    return json_resp([], status=201)


def patch_tabela(cur, tabela, cols):
    payload = request.get_json(silent=True) or {}
    campos = [k for k in payload if k in cols and IDENT.match(k)]
    clauses, params = parse_filtros(request.args, cols)
    if not campos or not clauses:
        return jsonify({"message": "nada para atualizar"}), 400
    sets = ", ".join(f"{c} = %s" for c in campos)
    sql = f"update {tabela} set {sets} where {' and '.join(clauses)} returning *"
    cur.execute(sql, [payload[c] for c in campos] + params)
    rows = [dict(r) for r in cur.fetchall()]
    prefer = (request.headers.get("Prefer") or "").lower()
    if "return=representation" in prefer:
        return json_resp(rows)
    return json_resp([])


def delete_tabela(cur, tabela, cols):
    clauses, params = parse_filtros(request.args, cols)
    if not clauses:
        return jsonify({"message": "filtro obrigatório"}), 400
    cur.execute(
        f"delete from {tabela} where {' and '.join(clauses)} returning *",
        params,
    )
    rows = [dict(r) for r in cur.fetchall()]
    prefer = (request.headers.get("Prefer") or "").lower()
    if "return=representation" in prefer:
        return json_resp(rows)
    return json_resp([])


@app.route("/", defaults={"caminho": "index.html"})
@app.route("/<path:caminho>")
def estatico(caminho):
    alvo = ROOT / caminho
    if not alvo.resolve().is_relative_to(ROOT.resolve()):
        return "não", 404
    if alvo.is_file():
        return send_from_directory(ROOT, caminho)
    return send_from_directory(ROOT, "index.html")


if __name__ == "__main__":
    print("Senha JEC local em http://127.0.0.1:8765/")
    app.run(host="127.0.0.1", port=8765, debug=False)
