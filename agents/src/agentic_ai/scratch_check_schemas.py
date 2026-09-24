import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # 1. Search assistants
        try:
            res = await client.post("http://127.0.0.1:2024/assistants/search", json={})
            print("Search status:", res.status_code)
            if res.status_code == 200:
                assistants = res.json()
                print("Assistants found:", len(assistants))
                for a in assistants:
                    aid = a["assistant_id"]
                    graph_id = a["graph_id"]
                    name = a["name"]
                    print(f"\nAssistant: {name} (ID: {aid}, Graph: {graph_id})")
                    
                    # 2. Fetch schemas
                    schema_res = await client.get(f"http://127.0.0.1:2024/assistants/{aid}/schemas")
                    print("Schema status:", schema_res.status_code)
                    if schema_res.status_code == 200:
                        schema_data = schema_res.json()
                        import json
                        print("Context Schema raw:")
                        print(json.dumps(schema_data.get("context_schema", {}), indent=2))
                        print("Config Schema raw:")
                        print(json.dumps(schema_data.get("config_schema", {}), indent=2))
            else:
                print("Response text:", res.text)
        except Exception as e:
            print("Error connecting to LangGraph API:", e)

if __name__ == "__main__":
    asyncio.run(main())
