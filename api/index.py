from flask import Flask
import numpy as np

app = Flask(__name__)

@app.route("/api/python/hello-world")
def hello_world():
    return "Hello world!"

@app.route("/api/python/goodbye-world")
def goodbye_world():
    return "goodbye world!"

@app.route("/api/python/numpy")
def numpy2():
    return str(np.median([1,3,5,10,22]))