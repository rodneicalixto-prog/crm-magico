INSERT INTO users (id, email, password_hash, role, is_active, two_fa_secret)
VALUES (
    gen_random_uuid(),
    'rodnei@calixtosolucoes.com.br',
    '$2b$12$x9T/eWNYG/XhXIARwNe7.ebdeTH9J7tMGhx10JZNc6HXL8Q2PLpjK',
    'super_admin',
    true,
    ''
)
ON CONFLICT (email) DO UPDATE
    SET password_hash = '$2b$12$x9T/eWNYG/XhXIARwNe7.ebdeTH9J7tMGhx10JZNc6HXL8Q2PLpjK',
        role         = 'super_admin',
        is_active    = true;
