
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { ChevronDown, Menu, PanelLeft, RefreshCw, UserRound } from "lucide-react";
import { Office365UsersService } from "../generated/services/Office365UsersService";
import { getCurrentUserIdentity } from "../services/currentUser";

// ==========================================
// INTERFACES
// ==========================================

interface AppHeaderProps {
  onResetData?: () => void;
  employeeCount: number;
  pageTitle?: string;
  onMenuToggle: () => void;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
}

interface UsuarioLogado {
  nome: string;
  email: string;
  cargo: string;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export const AppHeader: React.FC<AppHeaderProps> = ({
  onResetData,
  employeeCount,
  pageTitle = "Visão geral",
  onMenuToggle,
  onSidebarToggle,
  isSidebarCollapsed,
}) => {
  // ========================================
  // ESTADOS DO USUÁRIO
  // ========================================

  const [usuario, setUsuario] = useState<UsuarioLogado>({
    nome: "Carregando...",
    email: "",
    cargo: "",
  });

  const [fotoUsuario, setFotoUsuario] = useState<string | null>(
    null
  );

  const [carregandoUsuario, setCarregandoUsuario] =
    useState<boolean>(true);

  const [erroFoto, setErroFoto] = useState<boolean>(false);

  // ========================================
  // IDENTIFICAÇÃO AUTOMÁTICA DO USUÁRIO
  // ========================================

  useEffect(() => {
    let componenteAtivo = true;

    const carregarUsuario = async () => {
      let usuarioPrincipal = "";

      try {
        const identidade = await getCurrentUserIdentity();

        if (!componenteAtivo) return;

        const nome = identidade.displayName;
        const email = identidade.email;

        usuarioPrincipal = email;

        setUsuario({
          nome: nome || "Usuário",
          email,
          cargo: "",
        });
      } catch (erro) {
        console.error(
          "Não foi possível obter o contexto do Power Apps:",
          erro
        );
      }

      // ====================================
      // PERFIL CORPORATIVO MICROSOFT 365
      // ====================================

      try {
        const resposta =
          await Office365UsersService.MyProfile_V2(
            "id,displayName,mail,userPrincipalName,jobTitle"
          );

        if (!componenteAtivo) return;

        const perfil = resposta.data;

        if (perfil) {
          setUsuario((anterior) => ({
            nome:
              perfil.displayName ||
              anterior.nome,
            email:
              perfil.mail ||
              perfil.userPrincipalName ||
              anterior.email,
            cargo:
              perfil.jobTitle || "",
          }));
        }

        // ==================================
        // FOTOGRAFIA DO USUÁRIO
        // ==================================

        const identificadores = Array.from(
          new Set(
            [
              perfil?.id,
              perfil?.userPrincipalName,
              usuarioPrincipal,
            ].filter(
              (valor): valor is string =>
                typeof valor === "string" &&
                valor.trim().length > 0
            )
          )
        );

        for (const identificador of identificadores) {
          try {
            const respostaFoto =
              await Office365UsersService.UserPhoto_V2(
                identificador
              );

            if (!componenteAtivo) return;

            const dadosFoto = respostaFoto.data;

            if (
              typeof dadosFoto === "string" &&
              dadosFoto.length > 0
            ) {
              const enderecoFoto = dadosFoto.startsWith("data:")
                ? dadosFoto
                : `data:image/jpeg;base64,${dadosFoto}`;

              setFotoUsuario(enderecoFoto);
              setErroFoto(false);
              break;
            }
          } catch (erro) {
            // Tenta o próximo identificador.
            // Caso não exista fotografia, será exibido
            // o avatar alternativo.
            console.debug(
              "Foto indisponível para o identificador:",
              identificador
            );
          }
        }
      } catch (erro) {
        console.error(
          "Não foi possível carregar o perfil Microsoft 365:",
          erro
        );
      } finally {
        if (componenteAtivo) {
          setCarregandoUsuario(false);

          setUsuario((anterior) => ({
            ...anterior,
            nome:
              anterior.nome === "Carregando..."
                ? "Usuário indisponível"
                : anterior.nome,
          }));
        }
      }
    };

    carregarUsuario();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  // ========================================
  // INICIAIS DO USUÁRIO
  // ========================================

  const iniciaisUsuario = usuario.nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

  const mostrarFoto = Boolean(fotoUsuario) && !erroFoto;

  // ========================================
  // RENDERIZAÇÃO DO CABEÇALHO
  // ========================================

  return (
    <header
      className="sticky top-0 z-20 flex min-h-[58px] items-center justify-between gap-3 border-b border-white/80 bg-slate-50/90 px-3 py-2 shadow-[0_6px_22px_rgba(0,48,87,0.05)] backdrop-blur-xl sm:px-4 lg:px-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="shrink-0 rounded-lg p-2 text-oxford transition-colors hover:bg-sky-50 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onSidebarToggle}
          className="hidden shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-yinmn md:flex"
          aria-label={
            isSidebarCollapsed
              ? "Expandir barra lateral"
              : "Recolher barra lateral"
          }
          title={
            isSidebarCollapsed
              ? "Expandir barra lateral"
              : "Recolher barra lateral"
          }
        >
          <PanelLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-oxford">{pageTitle}</p>
          <p className="hidden text-[10px] text-slate-400 sm:block">
            {employeeCount} {employeeCount === 1 ? "colaborador" : "colaboradores"} na base
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {onResetData && (
          <button
            type="button"
            onClick={onResetData}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-white text-slate-500 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-yinmn sm:flex"
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}

        <div className="mx-1 hidden h-6 w-px bg-sky-100 sm:block" />

        <div className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-sky-50">
          <div className="hidden text-right sm:block">
            <p
              className="max-w-[180px] truncate text-xs font-semibold leading-none text-oxford"
              title={usuario.nome}
            >
              {usuario.nome}
            </p>

            <span
              className="mt-1 block max-w-[180px] truncate text-[10px] leading-none text-slate-400"
              title={usuario.email}
            >
              {usuario.cargo || usuario.email || (carregandoUsuario ? "Carregando perfil..." : "Perfil corporativo")}
            </span>
          </div>

          <div
            className="relative h-9 w-9 shrink-0 rounded-full"
            title={
              usuario.email
                ? `${usuario.nome} - ${usuario.email}`
                : usuario.nome
            }
          >

            {mostrarFoto ? (
              <img
                src={fotoUsuario!}
                alt={`Foto de perfil de ${usuario.nome}`}
                className="h-9 w-9 rounded-full border-2 border-white object-cover ring-1 ring-sky-200"
                referrerPolicy="no-referrer"
                onError={() => setErroFoto(true)}
              />
            ) : (
              <div
                role="img"
                aria-label={`Avatar de ${usuario.nome}`}
                className="flex h-9 w-9 select-none items-center justify-center rounded-full border-2 border-white bg-sky-100 text-xs font-bold text-sky-700 ring-1 ring-sky-200"
              >
                {carregandoUsuario ? (
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
                    aria-label="Carregando fotografia"
                  />
                ) : usuario.nome === "Usuário indisponível" ? (
                  <UserRound className="w-5 h-5" />
                ) : (
                  iniciaisUsuario || (
                    <UserRound className="w-5 h-5" />
                  )
                )}
              </div>
            )}
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
        </div>
      </div>
    </header>
  );
};
