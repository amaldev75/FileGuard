from django.contrib.auth.models import User
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import FileRecord, VerificationLog


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['username', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class FileRecordSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True, default=None)
    is_expired = serializers.BooleanField(read_only=True)
    expires_on = serializers.SerializerMethodField()

    def get_expires_on(self, obj):
        """The expiry as a plain date (YYYY-MM-DD) so every browser shows the same day."""
        return timezone.localtime(obj.expires_at).date().isoformat() if obj.expires_at else None

    class Meta:
        model = FileRecord
        fields = [
            'id', 'filename', 'file_type', 'file_size', 'upload_date', 'sha256_hash',
            'status', 'owner_name', 'approved_by_name', 'reviewed_at', 'review_note',
            'expires_at', 'expires_on', 'is_expired',
            'extension_status', 'extension_reason', 'extension_requested_at',
        ]
        # rsa_signature is intentionally not exposed to the frontend.


class VerificationLogSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = VerificationLog
        fields = [
            'id', 'filename', 'checked_at', 'result',
            'integrity_passed', 'authenticity_passed', 'owner_name',
        ]