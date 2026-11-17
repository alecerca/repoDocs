# repoDocs

GitHub integration: pull & push .md to a remote repo

## Overview

**Contexto:** el write-back escribe en el filesystem local (dev/preview).
**Propuesta:** poder conectarse a un repo de GitHub (token) y hacer pull de sus `.md` o push de las ediciones como commit/PR.
**Por qué es "fundable":** es la feature que vuelve a repoDocs útil para equipos distribuidos y repos remotos.
**Criterios:** listar repos remotos; pull de una rama; push como commit con mensaje editable; nunca tocar fuera de la carpeta del repo.

## Installation

```bash
# Clone the repository
git clone https://github.com/alecerca/repoDocs.git
cd repoDocs

# Install dependencies (if applicable)
pip install -r requirements.txt  # Python
# or
npm install  # Node.js
```

## Usage

```bash
# Run the project
python main.py  # Python
# or
node index.js  # Node.js
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

See [LICENSE](LICENSE) for details.
