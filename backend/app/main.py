from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agents.comparison_agent import ComparisonAgent, ComparisonResult
from app.agents.planner_agent import PlannerAgent, PlannerStatus
from app.agents.search_agent import Product, SearchAgent

app = FastAPI()

app.add_middleware(CORSMiddleware,
                    allow_origins = ["http://localhost:3000", "http://127.0.0.1:3000"],
                    allow_methods = ["*"],
                    allow_headers = ["*"],
                    )

max_clarifications = 10


@app.get("/")
def root():
    return {
        "message": "Welcome to Best Shopping Assistant API"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class RecommendRequest(BaseModel):
    message: str
    conversation: list[ChatMessage] = []


class RecommendResponse(BaseModel):
    status: PlannerStatus
    message: str
    conversation: list[ChatMessage]
    products: list[Product] = []
    comparison: Optional[ComparisonResult] = None

# =================================================================
# The above classes' purposes
# ChatMessage — defines what one message in a conversation
# RecommendRequest — defines what the frontend must send when it calls /recommend
# RecommendResponse — defines what /recommend sends back: status, message, the updated conversation, products, and comparison.
# =================================================================

@app.post("/recommend", response_model = RecommendResponse)
def recommend(request: RecommendRequest):
    planner = PlannerAgent()

    planner.conversation = []   # To store the conversation if user asks for more than one objects in one conversation
    for message in request.conversation:
        planner.conversation.append(message.model_dump())

    planner_result = planner.plan(request.message)

    if planner_result.status == PlannerStatus.NEEDS_CLARIFICATION:
        clarification_count = 0
        for message in planner.conversation:
            if message["role"] == "assistant":
                clarification_count += 1

        if clarification_count >= max_clarifications:
            planner_result.status = PlannerStatus.INVALID
            planner_result.message = "This request is too ambiguous, please try again."
            planner.conversation[-1]["content"] = planner_result.message

    updated_conversation = []
    for message in planner.conversation:
        chat_message = ChatMessage(role = message["role"], content = message["content"])
        updated_conversation.append(chat_message)

    if planner_result.status != PlannerStatus.READY:
        return RecommendResponse(status = planner_result.status,
                                message = planner_result.message,
                                conversation = updated_conversation
                                )

    search_agent = SearchAgent()
    products = search_agent.search(planner_result.structured_query)

    comparison_agent = ComparisonAgent()
    comparison = comparison_agent.compare(planner_result.structured_query, products)

    return RecommendResponse(status = planner_result.status,
                            message = planner_result.message,
                            conversation = updated_conversation,
                            products = products,
                            comparison = comparison
                            )

#   conda activate best-shopping-assistant

#       python -m uvicorn app.main:app --reload

#       http://127.0.0.1:3000

