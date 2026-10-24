from django.contrib import admin
from .models import FileRecord, VerificationLog


@admin.register(FileRecord)
class FileRecordAdmin(admin.ModelAdmin):
    list_display = ('filename', 'owner', 'status', 'upload_date', 'expires_at', 'file_size')
    list_filter = ('status',)
    readonly_fields = ('sha256_hash', 'rsa_signature')


@admin.register(VerificationLog)
class VerificationLogAdmin(admin.ModelAdmin):
    list_display = ('filename', 'owner', 'result', 'checked_at', 'integrity_passed', 'authenticity_passed')
    list_filter = ('result',)