"""
Core cryptographic operations used by FileGuard:
  - SHA-256 hashing of file content        (Integrity)
  - RSA signing / verifying of that hash   (Authenticity)
"""
import hashlib
import base64

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.exceptions import InvalidSignature

from . import keys


def compute_sha256(file_obj) -> str:
    """Compute the SHA-256 hash of an uploaded file. Returns a 64-char hex string."""
    sha256 = hashlib.sha256()
    file_obj.seek(0)
    for chunk in file_obj.chunks() if hasattr(file_obj, 'chunks') else iter(lambda: file_obj.read(8192), b''):
        sha256.update(chunk)
    file_obj.seek(0)
    return sha256.hexdigest()


def sign_hash(hash_hex: str) -> str:
    """Sign the given hash using the system's RSA private key. Returns base64 text."""
    private_key = keys.get_private_key()
    signature_bytes = private_key.sign(
        hash_hex.encode('utf-8'),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        hashes.SHA256(),
    )
    return base64.b64encode(signature_bytes).decode('utf-8')


def verify_signature(hash_hex: str, signature_b64: str) -> bool:
    """Verify a signature against a hash using the RSA public key."""
    public_key = keys.get_public_key()
    signature_bytes = base64.b64decode(signature_b64)
    try:
        public_key.verify(
            signature_bytes,
            hash_hex.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )
        return True
    except InvalidSignature:
        return False