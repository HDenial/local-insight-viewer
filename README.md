# Local Data Display

preciso criar um frontend, seguindo o blueprint desta imagem. Neste estilo e com essas cores. Os dados lidos não virão de um banco de dados real neste momento mas sim de um CSV em uma dada pasta local. o frontend deve operar localmente e se sediar em uma porta local que possa ser exposta através de um tunel cloudflare.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9147338-3976-4d0c-8d0c-f88ee682c92c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Dados (CSV)

Os dados exibidos vêm de arquivos `.csv` na pasta `data/` (um por operação).
O formato completo das colunas está em [`docs/FORMATO-CSV.md`](docs/FORMATO-CSV.md).

Para gerar um CSV completo (simulado ou a partir de tópicos ROS2):

```sh
python tools/ros2_to_csv.py --mission-id OP-20260601 --duracao 5h --intervalo 60s
```

### Frames da câmera

Cada linha do CSV pode apontar, na coluna `frame`, o frame capturado naquele instante
(`frames/<mission_id>/<HHMMSS>.jpg` ou uma URL). Os arquivos são servidos por
`src/routes/api/public/frames/$.ts`.

Enquanto não há frames reais, um `frame` vazio faz o card exibir a imagem de exemplo fixa.
A lógica definitiva de placeholder ("sem frame") está **comentada** em
`src/components/tracker/ReadingCard.tsx`, no bloco da imagem — basta descomentá-la quando
os frames reais estiverem disponíveis.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
cloudflared tunnel --url http://localhost:8080
```

