server {
    listen 80;
    server_name mivora.cnhalo.com;

    root /app/mivora;
    index index.html;
    autoindex off;

    location ~ (^|/)\. {
        deny all;
    }

    location ~ /latest\.json$ {
        default_type application/json;
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
