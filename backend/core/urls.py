from django.urls import path
from . import views

urlpatterns = [
    # authentication
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('me/', views.whoami, name='whoami'),

    # user: registration, verification, dashboard
    path('register/', views.register_file, name='register_file'),
    path('verify/', views.verify_file, name='verify_file'),
    path('files/', views.list_files, name='list_files'),
    path('files/<int:pk>/', views.delete_file, name='delete_file'),
    path('files/<int:pk>/download/', views.download_file, name='download_file'),
    path('files/<int:pk>/request-extension/', views.request_extension, name='request_extension'),
    path('history/', views.verification_history, name='verification_history'),
    path('history/<int:pk>/report/', views.download_report, name='download_report'),

    # admin
    path('admin/stats/', views.admin_stats, name='admin_stats'),
    path('admin/requests/', views.admin_requests, name='admin_requests'),
    path('admin/requests/<int:pk>/approve/', views.admin_approve, name='admin_approve'),
    path('admin/requests/<int:pk>/reject/', views.admin_reject, name='admin_reject'),
    path('admin/requests/<int:pk>/expiry/', views.admin_set_expiry, name='admin_set_expiry'),
    path('admin/requests/<int:pk>/extension/decline/', views.admin_decline_extension, name='admin_decline_extension'),
    path('admin/users/', views.admin_users, name='admin_users'),
    path('admin/users/<int:pk>/toggle/', views.admin_toggle_user, name='admin_toggle_user'),
    path('admin/tampered/', views.admin_tampered, name='admin_tampered'),
]