from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def home():
    return {"message": "AI Business Assistant Platform is running"}