"""Объектное хранилище S3 / MinIO (boto3) — ленивый импорт boto3."""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any

from app.core.config import settings

logger = logging.getLogger("rzd.storage")


class StorageService:
    def __init__(self) -> None:
        self._bucket = settings.s3_bucket
        self._client: Any | None = None

    def _get_client(self) -> Any:
        if self._client is None:
            import boto3
            from botocore.client import Config

            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                region_name=settings.s3_region,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                use_ssl=settings.s3_use_ssl,
                config=Config(signature_version="s3v4"),
            )
        return self._client

    def _ensure_bucket_sync(self) -> None:
        from botocore.exceptions import ClientError

        client = self._get_client()
        try:
            client.head_bucket(Bucket=self._bucket)
        except ClientError:
            logger.info("Создаю bucket %s", self._bucket)
            client.create_bucket(Bucket=self._bucket)

    def _put_sync(self, key: str, data: bytes, content_type: str) -> str:
        self._get_client().put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
        return key

    def _presign_sync(self, key: str, expires: int) -> str:
        return self._get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires,
        )

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    async def put_object(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        return await asyncio.to_thread(self._put_sync, key, data, content_type)

    async def presigned_url(self, key: str, expires: int = 3600) -> str:
        return await asyncio.to_thread(self._presign_sync, key, expires)


@lru_cache
def get_storage_service() -> StorageService:
    return StorageService()
