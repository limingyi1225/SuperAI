# Deployment Guide

This guide explains how to deploy the Homework Helper application using Docker.

## Prerequisites

- A Linux server (Ubuntu/Debian recommended)
- Docker and Docker Compose installed on the server

## Deployment Steps

1.  **Transfer Files**: Copy the project files to your server. You can use `rsync` or `git`.
    - If using git, clone the repository.
    - Important: Make sure your `.env.local` or environment variables are ready.

2.  **Environment Variables**:
    Create a `.env` file in the project root with your API keys:
    ```bash
    GOOGLE_AI_API_KEY=your_google_api_key
    OPENAI_API_KEY=your_openai_api_key
    ```

3.  **Build and Run**:
    Run the following command to build the image and start the container:
    ```bash
    docker-compose up -d --build
    ```

    This will start the application in detached mode on port 3000.

4.  **Access**:
    Open your browser and navigate to `http://your-server-ip:3000`.

## Updating the Application

1.  Pull the latest changes (git pull) or upload new files.
2.  Rebuild and restart the container:
    ```bash
    docker-compose up -d --build
    ```

## Logs

To view application logs:
```bash
docker-compose logs -f
```
