import os
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from app.agents.planner_agent import StructuredQuery
from app.agents.search_agent import Product

load_dotenv()


class ProductFeedback(BaseModel):
    name: str
    pros: list[str]
    cons: list[str]
    feedback: str


class ComparisonResult(BaseModel):
    summary: str
    product_feedback: list[ProductFeedback]
    recommended_product: Optional[str] = None
    recommendation_reason: str


default_model = "gpt-5"

default_system_prompt = """
You are the Comparison Agent for an AI shopping assistant.

You are given the user's original request (category, product, brand, budget, purpose)
and a list of candidate products found for them.

Rules:
1. For each product, give balanced feedback: a few pros, a few cons, and a short
   overall comment. Base this only on the product data provided (price, rating,
   specifications, review_summary) — never invent facts not present in the data.
2. Weigh trade-offs against the user's stated purpose and budget, not just price
   or rating alone.
3. Pick exactly one product as recommended_product (its exact name) and explain
   in recommendation_reason why it best fits this specific user's needs.
4. Write summary as a short, well-written paragraph (2-4 sentences) in natural
   prose that ties the comparison together across all products — suitable to
   display directly to the user, not a restatement of the per-product feedback.
5. Keep feedback, summary, and recommendation_reason concise.
"""


class ComparisonAgent:

    def __init__(self, model: str = default_model, system_prompt: str = default_system_prompt):
        self.client = OpenAI(api_key = os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.system_prompt = system_prompt

    def compare(self, query: StructuredQuery, products: list[Product]) -> ComparisonResult:
        if not products:
            return ComparisonResult(
                summary = "No products were found to compare.",
                product_feedback=[],
                recommended_product = None,
                recommendation_reason = "No products were found to compare.",
            )

        lines = [f"User request: {query.model_dump_json()}", "Candidate products:"]
        for product in products:
            lines.append(product.model_dump_json())

        user_content = "\n".join(lines)

        response = self.client.responses.parse(model = self.model,
                                                input = [{"role": "system", "content": self.system_prompt},
                                                        {"role": "user", "content": user_content},
                                                        ],
                                                text_format = ComparisonResult
                                                )

        return response.output_parsed
