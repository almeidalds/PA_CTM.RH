# CTM Brasil — RH

Aplicativo de gestão de Recursos Humanos do CTM Brasil, desenvolvido em React e TypeScript e publicado como **Power Apps Code App**.

## Funcionalidades

- Consulta e gestão de funcionários, férias e ausências.
- Acompanhamento de prazos, renovações e alertas contratuais.
- Gestão de contratações futuras, com importação de planilhas e efetivação transacional no Dataverse.
- Painéis de indicadores, riscos e relatórios.
- Administração de catálogos de RH, como zonas, cargos, idiomas e turnos.

## Tecnologias

- React 19, TypeScript e Vite.
- Tailwind CSS.
- Microsoft Power Apps SDK e Power Apps CLI (`pa`).
- Microsoft Dataverse como fonte de dados para funcionários, catálogos e contratações futuras.

## Pré-requisitos

- Node.js LTS e npm.
- Acesso ao ambiente Power Platform com Code Apps habilitado.
- Power Apps CLI e permissão para criar ou publicar aplicativos no ambiente.
- Para compilar o plug-in Dataverse: .NET SDK e suporte ao .NET Framework 4.6.2.

## Instalação e execução local

Na raiz do projeto:

```powershell
npm install
npm run dev
```

O servidor Vite usa a porta `3000`. Para executar o aplicativo pelo host local do Power Apps, use dois terminais:

```powershell
# Terminal 1
npm run dev
```

```powershell
# Terminal 2
npm run powerapps:run
```

## Validar o projeto

```powershell
npm run typecheck
npm run build
```

O build de produção é gerado em `dist/`. O comando `npm run build` também verifica os recursos referenciados pelo aplicativo. Para executar diagnóstico, verificação de tipos e build em sequência:

```powershell
npm run prepare:powerapps
```

## Inicializar o Power Apps Code App

Na primeira configuração, abra o PowerShell na raiz do projeto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\INICIAR-POWERAPPS.ps1
```

O script instala/verifica dependências e a CLI, solicita o **Environment ID** e cria `power.config.json` se ele ainda não existir. Se já existir, a configuração atual é mantida.

Autentique-se no ambiente antes de publicar:

```powershell
pa auth login
```

O arquivo `power.config.json` contém configuração específica do aplicativo e do ambiente. Não copie IDs de outro ambiente nem compartilhe esse arquivo publicamente.

## Publicar

```powershell
.\scripts\PUBLICAR-POWERAPPS.ps1
```

O script verifica a configuração, executa a verificação de tipos e o build antes de publicar com `pa app push`. Para incluir o aplicativo em uma Solution específica:

```powershell
.\scripts\PUBLICAR-POWERAPPS.ps1 -SolutionId "GUID-DA-SOLUTION"
```

Para usar o aplicativo no computador, abra a URL publicada em um navegador. Power Apps Code Apps não são compatíveis com o aplicativo Power Apps para Windows; consulte [POWER_APPS.md](./POWER_APPS.md) para detalhes e limitações.

## Dados e integração

Funcionários e catálogos são consultados no Dataverse. Contratações futuras usam a tabela `ctmbrasi_rhcontratacoesfuturas`; a efetivação chama a Custom API `ctmbrasi_EfetivarContratacaoFutura`, implementada pelo plug-in deste repositório.

Alguns recursos legados, como substituições e sobreposições de alertas, ainda usam `localStorage` e não são compartilhados entre usuários. A rotina de encerramento de contratos vencidos atualiza status e zona quando os dados são carregados ou atualizados no aplicativo; ela não é uma automação agendada do Dataverse.

Os modelos e serviços em `src/generated/` são gerados a partir das fontes Dataverse. Não edite esses arquivos manualmente. Para adicionar ou atualizar uma fonte de dados, use a Power Apps CLI e valide novamente o projeto:

```powershell
pa app add data-source
npm run typecheck
npm run build
```

Consulte [POWER_APPS.md](./POWER_APPS.md) para informações sobre esquemas, permissões, configuração e comportamento de cada integração.

## Plug-in de efetivação

O projeto do plug-in está em `plugins/CTM.RH.Efetivacao/` e tem como destino o .NET Framework 4.6.2. Para compilar e gerar o pacote NuGet:

```powershell
dotnet pack .\plugins\CTM.RH.Efetivacao\CTM.RH.Efetivacao.csproj --configuration Release
```

O pacote é gerado em `plugins/CTM.RH.Efetivacao/bin/Release/`. Para atualizar um Plug-in Package já registrado, use o Plug-in Registration Tool, escolha **Display by Package** e depois **Update**. Mantenha o mesmo `PackageId` e a mesma versão NuGet do pacote registrado; a versão do assembly pode ser incrementada. Não use **Register New Package** para atualizar um pacote existente.

## Solução de problemas

- **`pa` não encontrado:** instale/atualize a Power Apps CLI e abra um novo terminal.
- **Build ou Vite indisponível:** confira Node.js/npm e execute `npm install`.
- **`power.config.json` ausente:** inicialize o Code App conforme a seção acima.
- **Dependências locais corrompidas:** execute `.\scripts\REPARAR-PROJETO.ps1`. Atenção: o script remove `node_modules`, `dist` e, por padrão, `package-lock.json` antes de reinstalar as dependências. Use `-KeepLockFile` para preservar o lockfile.
- **Dados do Dataverse não carregam:** verifique o ambiente autenticado, as fontes configuradas no Code App e as permissões do usuário.
