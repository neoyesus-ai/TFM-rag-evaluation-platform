from io import BytesIO

from minio import Minio

from app.core.config import settings


class ObjectStorageService:
    def __init__(self) -> None:
        self.bucket_name = settings.minio_bucket_documents

        self.client = Minio(
            endpoint=f"{settings.minio_host}:{settings.minio_port}",
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure,
        )

    def ensure_bucket_exists(self) -> None:
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def upload_bytes(
        self,
        object_name: str,
        data: bytes,
        content_type: str,
    ) -> None:
        self.ensure_bucket_exists()

        stream = BytesIO(data)

        self.client.put_object(
            bucket_name=self.bucket_name,
            object_name=object_name,
            data=stream,
            length=len(data),
            content_type=content_type,
        )

    def delete_object(self, object_name: str) -> None:
        self.client.remove_object(
            bucket_name=self.bucket_name,
            object_name=object_name,
        )

    def get_presigned_download_url(
        self,
        object_name: str,
    ) -> str:
        return self.client.presigned_get_object(
            bucket_name=self.bucket_name,
            object_name=object_name,
        )


object_storage = ObjectStorageService()
