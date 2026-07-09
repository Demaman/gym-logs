FROM python:3.12-slim

WORKDIR /backend

RUN pip install uv --no-cache-dir

COPY pyproject.toml ./
RUN uv sync

COPY . .

RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
