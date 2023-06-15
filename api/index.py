from flask import Flask
app = Flask(__name__)

@app.route("/api/python/hello-world")
def hello_world():
    return "Hello world!"

@app.route("/api/python/goodbye-world")
def goodbye_world():
    return "goodbye world!"