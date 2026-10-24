import datetime

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from . import crypto_utils
from .models import FileRecord, VerificationLog
from .report import build_report
from .serializers import (
    FileRecordSerializer, SignupSerializer, VerificationLogSerializer,
)


def _parse_expiry(value):
    """
    Turns an optional date string (YYYY-MM-DD) into an aware datetime = the END of that day.
    Returns (datetime or None, error message or None). Empty means "no expiry".
    """
    if value in (None, ''):
        return None, None
    try:
        day = datetime.date.fromisoformat(str(value))
    except ValueError:
        return None, 'Expiry must be a date like 2026-12-31.'
    if day < timezone.localdate():
        return None, 'The expiry date cannot be in the past.'
    end_of_day = datetime.datetime.combine(day, datetime.time(23, 59, 59))
    return timezone.make_aware(end_of_day), None


# ---------------------------------------------------------------------------
# MODULE 0: User Authentication
# ---------------------------------------------------------------------------
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def signup(request):
    ser = SignupSerializer(data=request.data)
    if not ser.is_valid():
        first = next(iter(ser.errors.values()))
        return Response({'error': str(first[0])}, status=status.HTTP_400_BAD_REQUEST)
    ser.save()
    return Response({'message': 'Account created successfully. Please log in.'}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(username=request.data.get('username'), password=request.data.get('password'))
    if user is None:
        return Response({'error': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'username': user.username, 'is_admin': user.is_staff})


@api_view(['GET'])
def whoami(request):
    return Response({'username': request.user.username, 'is_admin': request.user.is_staff})


# ---------------------------------------------------------------------------
# MODULE 1: File Registration  (user submits -> admin approves -> signed)
# ---------------------------------------------------------------------------
@api_view(['POST'])
@parser_classes([MultiPartParser])
def register_file(request):
    """
    POST /api/register/
    The file is saved as PENDING with its SHA-256 hash as a receipt.
    It is NOT signed and cannot be used for verification until an admin approves it.
    """
    if request.user.is_staff:
        return Response({'error': 'Admin accounts review files; they cannot submit or verify them. Use a normal user account.'},
                        status=status.HTTP_403_FORBIDDEN)
    upload = request.FILES.get('file')
    if not upload:
        return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    file_hash = crypto_utils.compute_sha256(upload)

    record = FileRecord.objects.create(
        owner=request.user,
        file=upload,
        filename=upload.name,
        file_type=upload.content_type or '',
        file_size=upload.size,
        sha256_hash=file_hash,
        status='PENDING',
    )
    return Response(
        {'message': 'File submitted for admin approval.', 'file': FileRecordSerializer(record).data},
        status=status.HTTP_201_CREATED,
    )


# ---------------------------------------------------------------------------
# MODULE 2: Integrity & Authenticity Verification  (APPROVED files only)
# ---------------------------------------------------------------------------
@api_view(['POST'])
@parser_classes([MultiPartParser])
def verify_file(request):
    if request.user.is_staff:
        return Response({'error': 'Admin accounts review files; they cannot submit or verify them. Use a normal user account.'},
                        status=status.HTTP_403_FORBIDDEN)
    upload = request.FILES.get('file')
    if not upload:
        return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    record = (FileRecord.objects
              .filter(owner=request.user, filename=upload.name, status='APPROVED')
              .order_by('-upload_date').first())

    if record is None:
        pending = FileRecord.objects.filter(owner=request.user, filename=upload.name, status='PENDING').exists()
        message = (f'"{upload.name}" is still waiting for admin approval.' if pending
                   else f'"{upload.name}" has no approved original in FileGuard.')
        log = VerificationLog.objects.create(
            owner=request.user, filename=upload.name, file_record=None,
            result='NOT_REGISTERED', integrity_passed=False, authenticity_passed=False,
        )
        return Response({'result': 'NOT_REGISTERED', 'message': message,
                         'log': VerificationLogSerializer(log).data})

    current_hash = crypto_utils.compute_sha256(upload)
    integrity_passed = (current_hash == record.sha256_hash)
    authenticity_passed = integrity_passed and crypto_utils.verify_signature(
        record.sha256_hash, record.rsa_signature
    )
    result = 'VERIFIED' if (integrity_passed and authenticity_passed) else 'TAMPERED'
    if result == 'VERIFIED' and record.is_expired:
        result = 'EXPIRED'   # file is genuine, but the admin's approval has run out

    log = VerificationLog.objects.create(
        owner=request.user, filename=upload.name, file_record=record, result=result,
        integrity_passed=integrity_passed, authenticity_passed=authenticity_passed,
        stored_hash=record.sha256_hash, current_hash=current_hash,
    )
    payload = {
        'result': result,
        'integrity_passed': integrity_passed,
        'authenticity_passed': authenticity_passed,
        'stored_hash': record.sha256_hash,
        'current_hash': current_hash,
        'expires_at': record.expires_at,
        'log': VerificationLogSerializer(log).data,
    }
    if result == 'EXPIRED':
        on = timezone.localtime(record.expires_at).strftime('%d %b %Y')
        payload['message'] = (f'The file matches the approved original, but its approval expired on {on}. '
                              'Request an extension from your Dashboard, or submit the file again.')
    return Response(payload)


# ---------------------------------------------------------------------------
# MODULE 3: Dashboard, History, Download, Delete, Report
# ---------------------------------------------------------------------------
@api_view(['GET'])
def list_files(request):
    records = FileRecord.objects.filter(owner=request.user).order_by('-upload_date')
    return Response(FileRecordSerializer(records, many=True).data)


@api_view(['GET'])
def verification_history(request):
    logs = VerificationLog.objects.filter(owner=request.user).order_by('-checked_at')
    return Response(VerificationLogSerializer(logs, many=True).data)


@api_view(['GET'])
def download_file(request, pk):
    """GET /api/files/<id>/download/ - the owner (or an admin reviewing it) can download."""
    record = get_object_or_404(FileRecord, pk=pk)
    if record.owner != request.user and not request.user.is_staff:
        return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        handle = record.file.open('rb')
    except (FileNotFoundError, ValueError):
        return Response({'error': 'The stored file could not be found on the server.'},
                        status=status.HTTP_404_NOT_FOUND)
    return FileResponse(handle, as_attachment=True, filename=record.filename)


@api_view(['DELETE'])
def delete_file(request, pk):
    """DELETE /api/files/<id>/ - only the owner can delete. History rows are kept."""
    record = get_object_or_404(FileRecord, pk=pk, owner=request.user)
    record.file.delete(save=False)
    record.delete()
    return Response({'message': 'File deleted.'})


@api_view(['POST'])
def request_extension(request, pk):
    """POST /api/files/<id>/request-extension/ - the owner asks the admin to extend an expired approval."""
    if request.user.is_staff:
        return Response({'error': 'Admin accounts review files; they cannot submit or verify them. Use a normal user account.'},
                        status=status.HTTP_403_FORBIDDEN)
    record = get_object_or_404(FileRecord, pk=pk, owner=request.user)
    if record.status != 'APPROVED' or not record.is_expired:
        return Response({'error': 'Only an expired approval can be extended.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.extension_status == 'REQUESTED':
        return Response({'error': 'An extension has already been requested. Please wait for the admin.'},
                        status=status.HTTP_400_BAD_REQUEST)
    record.extension_status = 'REQUESTED'
    record.extension_reason = str(request.data.get('reason', ''))[:255]
    record.extension_requested_at = timezone.now()
    record.save(update_fields=['extension_status', 'extension_reason', 'extension_requested_at'])
    return Response({'message': 'Extension requested. The admin will review it.', 'file': FileRecordSerializer(record).data})


@api_view(['GET'])
def download_report(request, pk):
    """GET /api/history/<id>/report/ - PDF report for one verification."""
    log = get_object_or_404(VerificationLog, pk=pk)
    if log.owner != request.user and not request.user.is_staff:
        return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
    pdf = build_report(log)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="FileGuard_Report_{log.id:05d}.pdf"'
    return response


# ---------------------------------------------------------------------------
# MODULE 4: Admin (is_staff users only)
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_stats(request):
    users = User.objects.filter(is_staff=False)
    return Response({
        'users': users.count(),
        'pending': FileRecord.objects.filter(status='PENDING').count(),
        'approved': FileRecord.objects.filter(status='APPROVED').count(),
        'rejected': FileRecord.objects.filter(status='REJECTED').count(),
        'expired': FileRecord.objects.filter(status='APPROVED', expires_at__lt=timezone.now()).count(),
        'extension_requests': FileRecord.objects.filter(status='APPROVED', extension_status='REQUESTED').count(),
        'verified': VerificationLog.objects.filter(result='VERIFIED').count(),
        'tampered': VerificationLog.objects.filter(result='TAMPERED').count(),
        'not_registered': VerificationLog.objects.filter(result='NOT_REGISTERED').count(),
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_requests(request):
    """All registration requests, pending ones first."""
    records = FileRecord.objects.select_related('owner', 'approved_by').all()
    order = {'PENDING': 0, 'APPROVED': 1, 'REJECTED': 2}
    records = sorted(records, key=lambda r: (order[r.status], -r.upload_date.timestamp()))
    return Response(FileRecordSerializer(records, many=True).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_approve(request, pk):
    """Approve: re-hash the stored file, SIGN the hash, mark as the trusted original."""
    record = get_object_or_404(FileRecord, pk=pk)
    if record.status != 'PENDING':
        return Response({'error': f'This request is already {record.status.lower()}.'},
                        status=status.HTTP_400_BAD_REQUEST)

    expires_at, error = _parse_expiry(request.data.get('expires_at'))
    if error:
        return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

    with record.file.open('rb') as f:
        current_hash = crypto_utils.compute_sha256(f)
    if current_hash != record.sha256_hash:
        return Response({'error': 'The stored file no longer matches its submitted hash. Ask the user to upload it again.'},
                        status=status.HTTP_409_CONFLICT)

    record.rsa_signature = crypto_utils.sign_hash(current_hash)
    record.status = 'APPROVED'
    record.approved_by = request.user
    record.reviewed_at = timezone.now()
    record.review_note = str(request.data.get('note', ''))[:255]
    record.expires_at = expires_at
    record.save()
    return Response({'message': 'File approved and signed.', 'file': FileRecordSerializer(record).data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_set_expiry(request, pk):
    """Change, remove or end (expire_now) the validity period of an APPROVED file."""
    record = get_object_or_404(FileRecord, pk=pk)
    if record.status != 'APPROVED':
        return Response({'error': 'Only approved files have an expiry.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.data.get('expire_now'):
        record.expires_at = timezone.now()
        message = 'Approval ended. The file is now expired.'
    else:
        expires_at, error = _parse_expiry(request.data.get('expires_at'))
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        record.expires_at = expires_at
        # a new date (or removing the expiry) answers any pending extension request
        record.extension_status = ''
        record.extension_reason = ''
        record.extension_requested_at = None
        message = 'Expiry date saved.' if expires_at else 'Expiry removed. The approval is valid until further notice.'
    record.save(update_fields=['expires_at', 'extension_status', 'extension_reason', 'extension_requested_at'])
    return Response({'message': message, 'file': FileRecordSerializer(record).data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_decline_extension(request, pk):
    """Decline a user's extension request. The approval stays expired."""
    record = get_object_or_404(FileRecord, pk=pk)
    if record.extension_status != 'REQUESTED':
        return Response({'error': 'There is no extension request for this file.'}, status=status.HTTP_400_BAD_REQUEST)
    record.extension_status = 'DECLINED'
    record.save(update_fields=['extension_status'])
    return Response({'message': 'Extension request declined.', 'file': FileRecordSerializer(record).data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_reject(request, pk):
    record = get_object_or_404(FileRecord, pk=pk)
    if record.status != 'PENDING':
        return Response({'error': f'This request is already {record.status.lower()}.'},
                        status=status.HTTP_400_BAD_REQUEST)
    record.status = 'REJECTED'
    record.approved_by = request.user
    record.reviewed_at = timezone.now()
    record.review_note = str(request.data.get('note', ''))[:255]
    record.save()
    return Response({'message': 'File rejected.', 'file': FileRecordSerializer(record).data})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_users(request):
    out = []
    for u in User.objects.filter(is_staff=False).order_by('username'):
        out.append({
            'id': u.id, 'username': u.username, 'is_active': u.is_active,
            'joined': u.date_joined, 'files': u.files.count(), 'checks': u.logs.count(),
        })
    return Response(out)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_toggle_user(request, pk):
    user = get_object_or_404(User, pk=pk, is_staff=False)
    user.is_active = not user.is_active
    user.save()
    if not user.is_active:
        Token.objects.filter(user=user).delete()
    return Response({'id': user.id, 'is_active': user.is_active})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_tampered(request):
    logs = VerificationLog.objects.filter(result='TAMPERED').select_related('owner').order_by('-checked_at')
    return Response(VerificationLogSerializer(logs, many=True).data)