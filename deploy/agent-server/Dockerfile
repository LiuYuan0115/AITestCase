FROM python:3.12-slim
EXPOSE 8000
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .



CMD ["uvicorn", "agent_server:app", "--host", "0.0.0.0", "--port", "8000"]
