# CTM RH — Power Apps Code Apps

Este projeto foi ajustado para rodar como **Power Apps Code App** sem alterar as regras funcionais do painel.

## O que foi corrigido

- Vite configurado com `base: "./"` para que CSS/JS sejam carregados corretamente dentro do host do Power Apps.
- Plugin oficial `@microsoft/power-apps-vite` adicionado.
- SDK `@microsoft/power-apps` adicionado para permitir Dataverse, conectores e flows no próximo passo.
- Build padronizado em `./dist` com `index.html` como entry point.
- Servidor local padronizado na porta `3000`.
- Alias `@` corrigido para apontar para `src`.
- `ErrorBoundary` adicionado para impedir tela totalmente branca quando houver uma exceção React.
- Leitura das configurações do `localStorage` protegida contra bloqueios do navegador/iframe.
- Scripts PowerShell para inicializar e publicar o aplicativo.
- Referências específicas do Google AI Studio removidas da configuração do projeto.

## Pré-requisitos

1. Node.js LTS.
2. Acesso ao ambiente Power Platform onde Code Apps estão habilitados.
3. Permissão para criar/publicar aplicativos no ambiente.

## Caminho recomendado — CLI atual `pa`

Abra o PowerShell na pasta raiz do projeto e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\INICIAR-POWERAPPS.ps1
```

O script instala as dependências, verifica a Power Apps CLI, solicita o **Environment ID**, executa `pa app init` e valida o build.

O `power.config.json` aponta `logoPath` para o ícone quadrado `logo/app-icon-512.png`, criado a partir do símbolo já usado na navegação. Depois de alterar esse caminho ou a imagem, publique novamente com `pa app push` para atualizar o ícone do aplicativo.

## Compatibilidade do Power Apps Player

Este projeto é um `CodeApp`. Code Apps não são compatíveis com o aplicativo **Power Apps para Windows**. Para usá-lo no computador, abra a URL publicada no navegador. Se o requisito for executá-lo dentro do player nativo do Windows, será necessário portar a experiência para uma Canvas App compatível; mudar `appType` no `power.config.json` não converte o projeto. Consulte a [documentação de limitações dos Code Apps](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview#limitations).

### Testar no Power Apps local host

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run powerapps:run
```

### Publicar

```powershell
.\scripts\PUBLICAR-POWERAPPS.ps1
```

Se o Code App precisar entrar diretamente em uma Solution:

```powershell
.\scripts\PUBLICAR-POWERAPPS.ps1 -SolutionId "GUID-DA-SOLUTION"
```

## Comandos equivalentes

```powershell
npm install
pa auth login
pa app init --display-name "CTM - RH" --environment-id "SEU-ENVIRONMENT-ID" --build-path ./dist --file-entry-point index.html --app-url http://localhost:3000
npm run build
pa app push
```

## Compatibilidade com o fluxo antigo `pac code`

Se o seu computador ainda estiver usando o Power Platform CLI antigo, o projeto também está preparado para `./dist` + `index.html`. O equivalente é:

```powershell
pac auth create
pac code init --displayName "CTM - RH" --buildPath ./dist --fileEntryPoint index.html --appUrl http://localhost:3000
npm run build
pac code push
```

A CLI `pa` é o caminho mais novo e recomendado para os próximos passos.

## Dados e integração

Funcionários e catálogos são lidos do Dataverse pelos serviços gerados. Algumas funções preexistentes, como substituições e sobreposições do painel de alertas, ainda usam `localStorage` e não são compartilhadas entre usuários. A aba Contratações Futuras não usa dados simulados nem `localStorage`.

## Contratações Futuras

A tabela real configurada no projeto é `ctmbrasi_rhcontratacoesfuturas`, com conjunto `ctmbrasi_rhcontratacoesfuturases`. Ela é separada da tabela oficial `ctmbrasi_employeerecords`; registros pendentes não são incluídos nos carregamentos ou indicadores de funcionários ativos.

O modelo gerado contém os 21 campos da planilha, status e fase. Os códigos de status usados pela interface vêm de `src/generated/models/Ctmbrasi_rhcontratacoesfuturasesModel.ts`:

| Código gerado | Rótulo Dataverse | Rótulo na interface |
| --- | --- | --- |
| 583150000 | Aguardando Confirmação | Aguardando Confirmação |
| 583150001 | Início Confirmado | Início Confirmado |
| 583150002 | Data Adiada / Reagendada | Data Adiada / Reagendada |
| 583150003 | Desistência / Cancelado | Desistência / Cancelado |

O esquema gerado neste repositório ainda não oferece cargo/posição, responsável pelo acompanhamento, uma tabela de histórico dedicada, turno ou vários idiomas por contratação. A coluna Telefone é `IntegerType`, que não preserva zeros iniciais e não comporta telefones completos; a gravação rejeita valores que seriam truncados. Não invente nomes lógicos: defina as colunas/relacionamentos com o administrador do ambiente, gere novamente os serviços e atualize os mapeamentos.

As alterações de data e status são registradas como linhas nas observações Dataverse. Isso não substitui auditoria imutável; habilite a auditoria Dataverse e crie uma tabela de histórico vinculada à contratação antes de depender desse registro para conformidade.

A efetivação é chamada pelo app por meio da Custom API `ctmbrasi_EfetivarContratacaoFutura`. O app envia `Target` (registro da contratação) e `DataRealInicio` (`YYYY-MM-DD`); o servidor retorna `FuncionarioId` e `JaEfetivado`. A validação, criação/vínculo do funcionário e atualização da fase devem permanecer na operação transacional do Dataverse; não substitua isso por gravações sequenciais no cliente.

**Verifique o alinhamento do esquema antes do primeiro teste.** O plug-in espera `ctmbrasi_cargo` e `ctmbrasi_zonalookup` (com alternativa de texto `ctmbrasi_zona`), mas o esquema gerado neste repositório contém o lookup de zona `ctmbrasi_zonas` e não contém cargo. Confirme os nomes no ambiente; se os campos já foram criados, atualize as fontes/tipos e os mapeamentos do app e teste primeiro em desenvolvimento. Sem cargo/posição e zona válidos, o plug-in deve rejeitar a efetivação.

O botão só deve ser usado por usuários com permissão para executar a Custom API e para criar/atualizar os registros envolvidos. Teste também uma repetição da chamada, matrícula duplicada e dados incompletos; a repetição deve retornar o funcionário já vinculado, sem criar outro.

Para reconectar uma tabela ou atualizar as fontes de dados do aplicativo, execute a CLI na pasta do Code App e selecione a tabela correspondente:

```powershell
pa app add data-source
npm run typecheck
npm run build
```

O arquivo Excel original não veio anexado a esta solicitação. A importação usa os 21 rótulos e a ordem descritos no pedido; sem uma coluna de grupo, registra o nome do arquivo como origem e mantém datas incompletas em observações, sem inventar dia/ano.

## `power.config.json`

Não há um `power.config.json` real incluído de propósito, porque ele contém os IDs do seu ambiente/aplicativo e deve ser gerado pelo `pa app init` no ambiente correto. O arquivo `power.config.example.json` mostra apenas a estrutura esperada.

Não copie um `appId` de outro Code App: cada aplicativo deve ser inicializado/publicado no ambiente correto.

## Erro: `'vite' nao e reconhecido` / `Build output not found at './dist'`

Esse erro significa que as dependencias locais nao foram instaladas corretamente ou que `node_modules` ficou incompleto.

Na raiz do projeto, execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\REPARAR-PROJETO.ps1
```

O script:

1. remove uma instalacao incompleta de `node_modules`;
2. refaz `npm install`;
3. confirma o Vite com `npx --no-install vite --version`;
4. executa o diagnostico do projeto;
5. executa `npm run build`;
6. confirma a existencia de `dist/index.html`.

Somente depois disso execute:

```powershell
pa app run
```
