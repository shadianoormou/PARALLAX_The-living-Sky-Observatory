FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY services/science/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/science ./services/science

EXPOSE 8001
CMD ["sh", "-c", "uvicorn app.main:app --app-dir services/science --host 0.0.0.0 --port ${PORT:-8001}"]
