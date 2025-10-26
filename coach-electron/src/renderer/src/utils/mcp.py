# openai_mcp.py
from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import json
from openai import OpenAI

app = FastAPI()

MCP_ENDPOINT = "https://backend.composio.dev/v3/mcp/af322fd4-6f0d-495d-af41-0c531f576eb6/mcp?user_id=pg-test-39a1e895-2851-4444-97a1-30845f40ea45"

class ChatRequest(BaseModel):
    prompt: str
    openai_api_key: str

async def get_mcp_tools():
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            MCP_ENDPOINT,
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        )
        return response.json()

async def call_mcp_tool(tool_name: str, arguments: dict):
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            MCP_ENDPOINT,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments}
            }
        )
        return response.json()

@app.post("/chat")
async def chat(request: ChatRequest):
    # Get tools from Composio
    tools_response = await get_mcp_tools()
    mcp_tools = tools_response.get("result", {}).get("tools", [])
    
    # Convert to OpenAI format
    openai_tools = [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("inputSchema", {})
            }
        }
        for tool in mcp_tools
    ]
    
    client = OpenAI(api_key=request.openai_api_key)
    messages = [{"role": "user", "content": request.prompt}]
    
    # Agentic loop
    for _ in range(10):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=openai_tools
        )
        
        message = response.choices[0].message
        
        if message.tool_calls:
            messages.append(message)
            
            for tool_call in message.tool_calls:
                result = await call_mcp_tool(
                    tool_call.function.name,
                    json.loads(tool_call.function.arguments)
                )
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result.get("result"))
                })
        else:
            return {"response": message.content}
    
    return {"response": "Max iterations reached"}

@app.get("/tools")
async def list_tools():
    """List all available MCP tools"""
    tools_response = await get_mcp_tools()
    return tools_response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)