import { getContext } from "@microsoft/power-apps/app";
import { Office365UsersService } from "../generated/services/Office365UsersService";

export interface CurrentUserIdentity {
  displayName: string;
  email: string;
  objectId?: string;
  systemUserId?: string;
}

let cachedIdentity: Promise<CurrentUserIdentity> | undefined;

function clean(value: string | undefined): string {
  return value?.trim() || "";
}

async function fromPowerAppsContext(): Promise<CurrentUserIdentity | null> {
  try {
    const context = await getContext();
    const displayName = clean(context.user.fullName);
    const email = clean(context.user.userPrincipalName);

    if (!displayName && !email) return null;

    return {
      displayName: displayName || email,
      email,
      objectId: clean(context.user.objectId) || undefined,
      systemUserId: clean(context.user.systemUserId) || undefined,
    };
  } catch (error) {
    console.warn(
      "O host do Power Apps não forneceu o contexto do usuário; usando Microsoft 365 como alternativa.",
      error,
    );
    return null;
  }
}

async function fromMicrosoft365(): Promise<CurrentUserIdentity | null> {
  try {
    const response = await Office365UsersService.MyProfile_V2(
      "id,displayName,mail,userPrincipalName",
    );
    const profile = response.data;
    const email = clean(profile?.mail) || clean(profile?.userPrincipalName);
    const displayName = clean(profile?.displayName) || email;

    if (!displayName && !email) return null;

    return {
      displayName,
      email,
      objectId: clean(profile?.id) || undefined,
    };
  } catch (error) {
    console.warn(
      "Não foi possível identificar o usuário pelo Microsoft 365.",
      error,
    );
    return null;
  }
}

async function loadCurrentUser(): Promise<CurrentUserIdentity> {
  const platform = new URLSearchParams(window.location.search)
    .get("platformOS")
    ?.toLowerCase();
  const isNativeMobile = platform === "android" || platform === "ios";

  // O player móvel pode omitir systemUserId ou até falhar ao responder ao
  // getContext. No mobile, o perfil Microsoft 365 é a fonte primária; nos
  // demais hosts, preservamos o contexto mais rico do Power Apps.
  const primary = isNativeMobile
    ? await fromMicrosoft365()
    : await fromPowerAppsContext();
  const fallback = primary
    ? null
    : isNativeMobile
      ? await fromPowerAppsContext()
      : await fromMicrosoft365();
  const identity = primary || fallback;

  if (!identity) {
    throw new Error(
      "Não foi possível identificar o usuário autenticado. Verifique a conexão do Microsoft 365 e tente novamente.",
    );
  }

  return identity;
}

export async function getCurrentUserIdentity(): Promise<CurrentUserIdentity> {
  cachedIdentity ??= loadCurrentUser().catch((error) => {
    cachedIdentity = undefined;
    throw error;
  });
  return cachedIdentity;
}

export async function getCurrentUserDisplayName(): Promise<string> {
  const identity = await getCurrentUserIdentity();
  return identity.displayName || identity.email;
}
