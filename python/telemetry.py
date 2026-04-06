"""
Vendor-neutral OpenTelemetry setup for the FastAPI backend.

Reads standard OTEL env vars (same ones the Next.js side uses):
  OTEL_EXPORTER_OTLP_ENDPOINT  — e.g. https://api.axiom.co
  OTEL_EXPORTER_OTLP_HEADERS   — e.g. Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
  OTEL_SERVICE_NAME             — defaults to "rej-studio-py"

No-ops gracefully when OTEL_EXPORTER_OTLP_ENDPOINT is not set, so local
dev works without any configuration.
"""

import os

from fastapi import FastAPI


def init_telemetry(app: FastAPI) -> None:
    """Instrument a FastAPI app with OpenTelemetry. No-op if unconfigured."""
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return

    # Parse OTEL_EXPORTER_OTLP_HEADERS into a dict.
    # Format: "Key1=Value1,Key2=Value2"
    raw_headers = os.environ.get("OTEL_EXPORTER_OTLP_HEADERS", "")
    headers: dict[str, str] = {}
    for pair in raw_headers.split(","):
        pair = pair.strip()
        if "=" in pair:
            k, v = pair.split("=", 1)
            headers[k.strip()] = v.strip()

    service_name = os.environ.get("OTEL_SERVICE_NAME", "rej-studio-py")

    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    exporter = OTLPSpanExporter(
        endpoint=f"{endpoint.rstrip('/')}/v1/traces",
        headers=headers,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
