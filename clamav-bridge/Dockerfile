FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends clamav-daemon clamav-freshclam \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/clamav /run/clamav \
    && chown -R clamav:clamav /var/lib/clamav /run/clamav

WORKDIR /app
COPY clamd.conf /etc/clamav/clamd.conf
COPY server.mjs start.sh ./
RUN chmod 0555 /app/start.sh

ENV PORT=8080
EXPOSE 8080
CMD ["/app/start.sh"]
