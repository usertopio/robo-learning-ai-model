FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "ai_bridge.py"]
