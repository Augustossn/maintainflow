# Validação

Verificação realizada em 2 de outubro de 2026.

| Verificação | Resultado |
| --- | --- |
| Testes unitários .NET (sem integração) | 14 aprovados |
| Testes da interface com Vitest | 3 aprovados |
| Playwright em desktop e celular | 6 aprovados |
| Acessibilidade do dashboard e formulário (axe) | Aprovada nos cenários automatizados |
| Compilação da interface e solução .NET | Aprovada |
| Configuração Docker Compose | Validada com `docker compose config --quiet` |

Os testes de navegador cobrem criação, atribuição, início, aceitação explícita de checklist do assistente, confirmação e conclusão de uma ordem. Também verificam validação de formulário, navegação responsiva e restauração do Kanban quando uma atualização recebe conflito da API simulada. As capturas em `docs/screenshots` foram geradas a partir do MaintainFlow na porta 5184.

A demonstração usa dados locais e a recuperação de conflitos usa respostas simuladas. Esses resultados não comprovam integração real com banco ou mensageria. O teste de integração SQL Server/RabbitMQ foi tentado, mas o Docker não respondeu; a execução foi encerrada sem resultado. Para executá-lo em um ambiente com Docker disponível, siga o README e habilite `RUN_INTEGRATION=1`.

As imagens Docker não foram construídas nesta sessão e os manifests Kubernetes não foram aplicados a um cluster. Há um aviso de tamanho do pacote principal na compilação da interface, sem impedir a geração dos arquivos de produção.
