import { Ctmbrasi_EfetivarContratacaoFuturaService } from "../generated/services/Ctmbrasi_EfetivarContratacaoFuturaService";
import { Ctmbrasi_rhcontratacoesfuturasesService } from "../generated/services/Ctmbrasi_rhcontratacoesfuturasesService";

const EFFECTIVE_PHASE = 583150001;

type ActivationResponse = {
  FuncionarioId: string;
  JaEfetivado: boolean;
};

export async function efetivarContratacaoFutura(
  contratacaoId: string,
  dataRealInicio: string,
): Promise<{ funcionarioId: string; jaEfetivado: boolean }> {
  if (!contratacaoId.trim()) {
    throw new Error("A contratação não possui um identificador válido.");
  }
  const parsedDate = new Date(`${dataRealInicio}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dataRealInicio) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== dataRealInicio
  ) {
    throw new Error("Informe a data real de início no formato AAAA-MM-DD.");
  }

  const result =
    await Ctmbrasi_EfetivarContratacaoFuturaService
      .ctmbrasi_EfetivarContratacaoFutura(
        contratacaoId,
        dataRealInicio,
      );

  const activationResponse = result.success
    ? (result.data as Partial<ActivationResponse>)
    : undefined;
  const responseEmployeeId = activationResponse?.FuncionarioId;
  const verification =
    await Ctmbrasi_rhcontratacoesfuturasesService.get(contratacaoId, {
      select: [
        "ctmbrasi_fase",
        "_ctmbrasi_funcionarioefetivado_value",
      ],
    });

  if (!verification.success || !verification.data) {
    const apiError = result.success
      ? ""
      : ` A API retornou: ${
          result.error?.message ||
          "O Dataverse não conseguiu efetivar a contratação."
        }`;
    throw new Error(
      `Não foi possível confirmar o vínculo da efetivação no Dataverse.${apiError} ${
        verification.error?.message ??
        "atualize os dados e verifique a contratação antes de tentar novamente."
      }`,
    );
  }

  const funcionarioId =
    verification.data._ctmbrasi_funcionarioefetivado_value;
  if (
    verification.data.ctmbrasi_fase !== EFFECTIVE_PHASE ||
    !funcionarioId
  ) {
    if (!result.success) {
      throw new Error(
        `A efetivação não foi confirmada e a contratação continua sem funcionário vinculado. A API retornou: ${
          result.error?.message ||
          "O Dataverse não conseguiu efetivar a contratação."
        } Consulte o Plugin Trace Log antes de tentar novamente.`,
      );
    }

    throw new Error(
      "A API respondeu sucesso, mas a contratação ainda não está marcada como efetivada com um funcionário vinculado. Atualize os dados e verifique o registro antes de tentar novamente.",
    );
  }

  if (
    responseEmployeeId &&
    responseEmployeeId.toLocaleLowerCase() !== funcionarioId.toLocaleLowerCase()
  ) {
    throw new Error(
      "O ID de funcionário retornado pela API não corresponde ao vínculo salvo na contratação. Encaminhe o registro ao administrador antes de tentar novamente.",
    );
  }

  return {
    funcionarioId,
    jaEfetivado: !result.success || activationResponse?.JaEfetivado === true,
  };
}
