# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Set environment variables
ENV NODE_VERSION=20

# Set working directory
WORKDIR /app

# Install dependencies
RUN apt update && apt install -y \
    curl \
    unzip \
    wget \
    gnupg \
    ca-certificates \
    jq

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash - \
    && apt install -y nodejs

# Install Chrome manually
RUN wget -qO- https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb > chrome.deb \
    && apt install -y ./chrome.deb \
    && rm chrome.deb

# Install ChromeDriver
RUN wget -qO- https://chromedriver.storage.googleapis.com/$(curl -s https://chromedriver.storage.googleapis.com/LATEST_RELEASE)/chromedriver_linux64.zip > chromedriver.zip \
    && unzip chromedriver.zip \
    && mv chromedriver /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm chromedriver.zip

# Install Axe CLI globally
RUN npm install -g @axe-core/cli

#Install Pa11y globally
RUN npm install -g pa11y

# Copy and set permissions for the script
COPY run-axe.sh /usr/local/bin/run-axe.sh
RUN chmod +x /usr/local/bin/run-axe.sh

COPY pa11y-config.json /app/pa11y-config.json

# Default command
ENTRYPOINT ["/usr/local/bin/run-axe.sh"]