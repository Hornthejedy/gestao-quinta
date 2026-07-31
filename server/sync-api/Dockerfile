FROM python:3.12-alpine

WORKDIR /app
COPY server.py /app/server.py

ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATA_DIR=/data
ENV FARM_ID=quinta_principal
ENV SYNC_SECRET=sync_bb7a7dbc1b5609455cb9f02b

EXPOSE 8000

CMD ["python", "/app/server.py"]
