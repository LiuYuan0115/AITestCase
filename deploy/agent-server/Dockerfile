FROM python:3.12-slim
EXPOSE 8000
WORKDIR /app

COPY . .
RUN pip install -r requirements.txt



CMD ["uvicorn", "agent_server:app", "--host", "0.0.0.0", "--port", "8000"]
