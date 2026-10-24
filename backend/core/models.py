from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class FileRecord(models.Model):
    """
    Module 1: File Registration.
    A user uploads a file -> it is saved as PENDING (hash only, no signature).
    An admin approves it -> the hash is re-checked and SIGNED, and the file
    becomes the trusted original (APPROVED).
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='registered_files/')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveIntegerField(help_text="Size in bytes")
    upload_date = models.DateTimeField(auto_now_add=True)

    sha256_hash = models.CharField(max_length=64)                 # hex digest, always 64 chars
    rsa_signature = models.TextField(blank=True, default='')      # empty until an admin approves

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_files'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=255, blank=True, default='')

    # Optional validity period of the approval. Empty = the approval never expires.
    expires_at = models.DateTimeField(null=True, blank=True)

    # Extension request: when the approval has expired the owner may ask the admin to extend it.
    EXTENSION_CHOICES = [
        ('', 'None'),
        ('REQUESTED', 'Requested'),
        ('DECLINED', 'Declined'),
    ]
    extension_status = models.CharField(max_length=10, choices=EXTENSION_CHOICES, blank=True, default='')
    extension_reason = models.CharField(max_length=255, blank=True, default='')
    extension_requested_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_expired(self):
        """True when an approved file's validity period has ended."""
        return self.expires_at is not None and timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.filename} [{self.status}]"


class VerificationLog(models.Model):
    """
    Module 3: Dashboard & Verification History.
    One row per verification attempt. Hashes are stored so a report can be
    generated later, even if the file record has been deleted.
    """
    RESULT_CHOICES = [
        ('VERIFIED', 'Verified'),
        ('TAMPERED', 'Tampered'),
        ('NOT_REGISTERED', 'Not Registered'),
        ('EXPIRED', 'Expired'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logs')
    filename = models.CharField(max_length=255)
    file_record = models.ForeignKey(
        FileRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs'
    )
    checked_at = models.DateTimeField(auto_now_add=True)
    result = models.CharField(max_length=20, choices=RESULT_CHOICES)
    integrity_passed = models.BooleanField(default=False)
    authenticity_passed = models.BooleanField(default=False)
    stored_hash = models.CharField(max_length=64, blank=True, default='')
    current_hash = models.CharField(max_length=64, blank=True, default='')

    def __str__(self):
        return f"{self.filename} - {self.result} @ {self.checked_at}"