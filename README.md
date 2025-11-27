<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/130TkEYRvnFWjRnzckwyhfq7PUmpMkuc1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Docker

Instruções rápidas para rodar a aplicação em Docker (build e servir via nginx):

1. Copie `.env.example` para `.env` e preencha `GEMINI_API_KEY` (opcional - a app usa essa variável em build):

2. Build e start usando docker-compose:

    - Build e rodar:

       `docker compose up --build -d`

    - Apenas build:

       `docker compose build`

    - Subir sem rebuild:

       `docker compose up -d`

3. Acesse a aplicação em: `http://localhost:3000/trackflow/` (o app é servido sob o caminho `/trackflow/`).

Verificação rápida após subir o container:

 - `curl -I http://localhost:3000/trackflow/` deve retornar 200 e conteúdo HTML.
 - `curl -I http://localhost:3000/` deve redirecionar para `/trackflow/`.

Se preferir usar apenas Docker (sem compose):

 - Build: `docker build --build-arg GEMINI_API_KEY=$GEMINI_API_KEY -t trackflow-dashboard .`
 - Run: `docker run -p 3000:3000 --env GEMINI_API_KEY=$GEMINI_API_KEY trackflow-dashboard`

Observação: o build do Vite injeta `GEMINI_API_KEY` como build-arg para que o `vite.config.ts` possa usá-la.
