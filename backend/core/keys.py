"""
RSA key management for FileGuard.
Step 1 from the project design: "System Setup (One time only)".
"""
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from django.conf import settings


def _generate_and_save_keys():
    """Generate a new RSA key pair and write both keys to keys/ as .pem files."""
    settings.RSA_KEYS_DIR.mkdir(parents=True, exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    settings.RSA_PRIVATE_KEY_PATH.write_bytes(private_bytes)
    settings.RSA_PUBLIC_KEY_PATH.write_bytes(public_bytes)

    return private_key, public_key


def get_private_key():
    """Load the private key from disk, generating a new key pair if needed."""
    if not Path(settings.RSA_PRIVATE_KEY_PATH).exists():
        _generate_and_save_keys()

    key_bytes = settings.RSA_PRIVATE_KEY_PATH.read_bytes()
    return serialization.load_pem_private_key(key_bytes, password=None)


def get_public_key():
    """Load the public key from disk, generating a new key pair if needed."""
    if not Path(settings.RSA_PUBLIC_KEY_PATH).exists():
        _generate_and_save_keys()

    key_bytes = settings.RSA_PUBLIC_KEY_PATH.read_bytes()
    return serialization.load_pem_public_key(key_bytes)