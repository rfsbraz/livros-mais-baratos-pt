# Política de segurança

| Versão             | Suporte           |
| ------------------ | ----------------- |
| 0.1.x              | Sim, experimental |
| Versões anteriores | Não               |

Comunica vulnerabilidades para **rfsbraz@proton.me**, ou usa **Security > Report a vulnerability** no GitHub quando essa opção estiver disponível. Não publiques vulnerabilidades por corrigir em issues ou discussões públicas. O contacto por email permanece disponível independentemente da visibilidade do repositório.

Inclui passos de reprodução, versão afetada e impacto. Não envies credenciais reais ou dados pessoais. O objetivo é responder inicialmente em sete dias; o prazo de correção depende da gravidade e da disponibilidade do responsável.

A extensão não executa HTML ou scripts das lojas, não envia cookies de sessão nos pedidos de comparação e não pede acesso irrestrito a sites. Segue redirecionamentos normais sem credenciais e rejeita respostas cuja origem final não pertença à loja pedida. O conteúdo remoto é não fiável: preços e ligações têm de corresponder a um ISBN validado e a uma origem HTTPS permitida.

A CI procura segredos no histórico Git obtido e audita dependências de desenvolvimento em PRs, alterações ao ramo principal e verificações semanais. Não são distribuídas dependências npm em execução. Uma análise sem resultados não garante a ausência de todas as vulnerabilidades. Consulta o [relatório de preparação para código aberto](docs/oss-readiness.md).
