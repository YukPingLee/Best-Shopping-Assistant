import os
from enum import Enum
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()


class PlannerStatus(str, Enum):
    READY = "ready"
    NEEDS_CLARIFICATION = "needs_clarification"
    INVALID = "invalid" # invalid handles the impossible request, like drugs, dragon


class StructuredQuery(BaseModel):
    category: Optional[str] = None
    product: Optional[str] = None
    brand: Optional[str] = None
    budget: Optional[float] = None
    purpose: Optional[str] = None

# OpenAI sdk requires the format exactly like this
class PlannerResponse(BaseModel):
    status: PlannerStatus
    message: str
    structured_query: Optional[StructuredQuery] = None
    missing_fields: list[str] = Field(default_factory=list)

# ======================================================================
# The above are for openai sdk to pass to the model.
# They look weird but they are the standard.
# ======================================================================

default_model = "gpt-5"

default_system_prompt = """
You are the Planner Agent for an AI shopping assistant.

Your job is to analyse the user's shopping request and populate the PlannerResponse schema.

Rules:
1. Extract category, product, brand, budget, and purpose.
2. Return READY if a useful product search can already be performed.
3. Return NEEDS_CLARIFICATION only if the missing information prevents a useful search.
4. Do NOT ask optional questions when status is READY.
5. If status is NEEDS_CLARIFICATION, explain what's missing and populate missing_fields.
6. Never invent information.
7. Keep the message concise.
8. Return category and brand in lowercase.
9. NEEDS_CLARIFICATION if both product and category are missing — a search needs to know
   what to look for.

Examples of valid categories: hiking shoes, laptop, smartphone, headphones.
"""


class PlannerAgent:

    def __init__(self, client: Optional[OpenAI] = None, model: str = default_model, system_prompt: str = default_system_prompt):
        self.client = client or OpenAI(api_key = os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.system_prompt = system_prompt
        self.conversation: list[dict] = []

    def plan(self, user_message: str) -> PlannerResponse:
        self.conversation.append({"role": "user", "content": user_message})

        response = self.client.responses.parse(model = self.model,
                                                input = [{"role": "system", "content": self.system_prompt}] + self.conversation,
                                                text_format = PlannerResponse,
                                                )

        result = response.output_parsed

        # Note: the model might not return a structured_query
        missing_product_and_category = (result.structured_query is None or (not result.structured_query.product and not result.structured_query.category))

        if result.status == PlannerStatus.READY and missing_product_and_category:
            result.status = PlannerStatus.NEEDS_CLARIFICATION
            result.message = "I need to know what product or category you're looking for."
            result.missing_fields = ["product", "category"]

        self.conversation.append({"role": "assistant", "content": result.message})

        return result
