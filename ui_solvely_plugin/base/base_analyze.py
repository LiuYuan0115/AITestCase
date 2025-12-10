import json


def analyze_data(filename):
    with open("./data/" + filename, "r", encoding="utf-8") as f:
        list_data = []
        dict_data = json.load(f)
        for value in dict_data.values():
            list_data.append(value)
        return list_data