import os
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from app.agents.planner_agent import StructuredQuery

load_dotenv()

client = OpenAI(api_key = os.getenv("OPENAI_API_KEY"))

model = "gpt-5"

budget_tolerance = 0.15


class Product(BaseModel):
    name: str
    brand: str
    price: float
    url: str
    category: str   # "hiking shoes", "laptop", "headphones"
    rating: Optional[float] = None
    review_summary: Optional[str] = None
    specifications: list[str] = []


class SearchResponse(BaseModel):
    products: list[Product]

# ======================================================================
#  Product and SearchRespnse are for openai sdk to pass to the model.
# They need to be in this format.
# Standard.
# ======================================================================

extraction_prompt = """
You are the Search Agent for an AI shopping assistant.

You are given raw web search findings about products. Extract a clean, structured
list of the most relevant, currently available products.

Rules:
1. Only include products explicitly mentioned in the findings. Never invent products,
   prices, or specifications.
2. name, brand, price, url, and category are required. If any of them is not present
   in the findings, drop that product entirely.
3. rating is optional. Omit it if not present in the findings.
4. review_summary is optional. Only include it if the findings mention actual customer
   opinions or reviews for that product. Summarize them in a short paragraph. Never invent
   or assume typical sentiment for a product category.
5. Prices must be plain numbers (no currency symbols).
6. Return at most 5 products, ordered by relevance to the request.
"""


class SearchAgent:

    def _build_search_query(self, query: StructuredQuery) -> str:
        if query.product:
            first_part = query.product
        else:
            first_part = query.category

        parts = [first_part]

        if query.brand:
            parts.append(query.brand)
        if query.budget:
            parts.append(f"around ${query.budget}")
        if query.purpose:
            parts.append(f"for {query.purpose}")

        return " ".join(parts)

    def search(self, query: StructuredQuery) -> list[Product]:

        search_query = self._build_search_query(query)

        search_prompt = " ".join([f"Find the most relevant, currently available products for: {search_query}.",
                                "For each product include its name, brand, price, a product page URL,",
                                "rating if available, and what customers say about it in reviews if you",
                                "find any — report the actual opinions/quotes, don't summarize them.",
                                ])

        web_result = client.responses.create(model = model,
                                            tools=[{"type": "web_search"}],
                                            input=search_prompt)

        parsed = client.responses.parse(model = model,
                                        input = [{"role": "system", "content": extraction_prompt},
                                                {"role": "user", "content": web_result.output_text},
                                                ],
                                        text_format = SearchResponse,
                                        )

        products = parsed.output_parsed.products

        if query.budget is not None:
            max_price = query.budget * (1 + budget_tolerance)

            products_near_budget = []
            for product in products:
                if product.price <= max_price:
                    products_near_budget.append(product)

            products = products_near_budget

        return products
