FROM nginx:alpine
EXPOSE 8080
COPY nginx.conf /etc/nginx/nginx.conf.template
CMD ["/bin/sh", "-c", "envsubst '${API_KEY}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]