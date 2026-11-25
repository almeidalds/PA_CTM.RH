
import { useEffect, useState } from "react";
import { Ctmbrasi_employeerecordsesService } from "../generated/services/Ctmbrasi_employeerecordsesService";

interface FuncionarioAvatarProps {
  funcionarioId: string;
  nome: string;
  size?: "detail" | "card";
  fotoUrl?: string;
  fotoTimestamp?: number;
}

interface FotoFuncionario {
  bytes: Uint8Array;
  tipo: string;
}

// Destino no Dataverse:
// tabela (schema): ctmbrasi_EmployeeRecords
// coluna (schema): ctmbrasi_FotodoFuncionario
// A Web API exige o nome lógico da coluna, em letras minúsculas.
export const EMPLOYEE_PHOTO_COLUMN = "ctmbrasi_fotodofuncionario" as const;

const fotoCache = new Map<string, Promise<FotoFuncionario | null>>();
const FOTO_ATUALIZADA_EVENT = "rh:foto-funcionario-atualizada";

function notificarFotoAtualizada(funcionarioId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string>(FOTO_ATUALIZADA_EVENT, { detail: funcionarioId })
  );
}

function converterImagemParaBytes(dados: unknown): Uint8Array {
  if (dados instanceof Uint8Array) return dados;
  if (dados instanceof ArrayBuffer) return new Uint8Array(dados);
  if (ArrayBuffer.isView(dados)) {
    return new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength);
  }
  if (Array.isArray(dados)) return Uint8Array.from(dados);
  if (dados && typeof dados === "object") {
    const objeto = dados as { data?: unknown; value?: unknown };
    if (objeto.data !== undefined) return converterImagemParaBytes(objeto.data);
    if (objeto.value !== undefined) return converterImagemParaBytes(objeto.value);
  }

  // O runtime do Power Apps 1.6 converte respostas image/* para Base64,
  // apesar de downloadImage estar tipado como Uint8Array.
  if (typeof dados === "string") {
    const base64 = dados.includes(",") ? dados.slice(dados.indexOf(",") + 1) : dados;
    const binario = window.atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binario.length);
    for (let indice = 0; indice < binario.length; indice += 1) {
      bytes[indice] = binario.charCodeAt(indice);
    }
    return bytes;
  }

  return new Uint8Array();
}

function identificarTipoImagem(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "application/octet-stream";
}

function converterBytesParaDataUrl(bytes: Uint8Array, tipo: string): string {
  const partes: string[] = [];
  const tamanhoParte = 8192;
  for (let inicio = 0; inicio < bytes.length; inicio += tamanhoParte) {
    const parte = bytes.subarray(inicio, Math.min(inicio + tamanhoParte, bytes.length));
    partes.push(String.fromCharCode(...parte));
  }
  return `data:${tipo};base64,${window.btoa(partes.join(""))}`;
}

async function carregarMiniaturaPeloRegistro(
  funcionarioId: string,
): Promise<FotoFuncionario | null> {
  const resultado = await Ctmbrasi_employeerecordsesService.get(funcionarioId, {
    select: [EMPLOYEE_PHOTO_COLUMN],
  });
  if (!resultado.success || !resultado.data) return null;

  const dados = resultado.data[EMPLOYEE_PHOTO_COLUMN] as unknown;
  if (!dados) return null;
  const bytes = dados instanceof Blob
    ? new Uint8Array(await dados.arrayBuffer())
    : converterImagemParaBytes(dados);
  return bytes.byteLength
    ? { bytes, tipo: identificarTipoImagem(bytes) }
    : null;
}

function carregarFotoFuncionario(
  funcionarioId: string,
  tamanhoCompleto: boolean
): Promise<FotoFuncionario | null> {
  const chaveCache = `${funcionarioId}:${tamanhoCompleto ? "completa" : "miniatura"}`;
  const fotoEmCache = fotoCache.get(chaveCache);
  if (fotoEmCache) return fotoEmCache;

  const requisicao = (async () => {
    const resultado = await Ctmbrasi_employeerecordsesService.downloadImage(
      funcionarioId,
      EMPLOYEE_PHOTO_COLUMN,
      tamanhoCompleto
    ).catch(() => null);

    // Algumas colunas de imagem guardam somente a miniatura. Nesses casos,
    // o Dataverse responde sem conteúdo quando size=full é solicitado.
    if ((!resultado?.success || !resultado.data) && tamanhoCompleto) {
      return carregarFotoFuncionario(funcionarioId, false);
    }
    if (!resultado?.success || !resultado.data) {
      // Alguns hosts do Power Apps não entregam o endpoint binário $value.
      // A leitura explícita da coluna retorna a miniatura em Base64.
      return carregarMiniaturaPeloRegistro(funcionarioId);
    }

    const dadosRecebidos = resultado.data as unknown;
    const bytes = dadosRecebidos instanceof Blob
      ? new Uint8Array(await dadosRecebidos.arrayBuffer())
      : converterImagemParaBytes(dadosRecebidos);
    if (!bytes.byteLength) {
      if (tamanhoCompleto) return carregarFotoFuncionario(funcionarioId, false);
      return carregarMiniaturaPeloRegistro(funcionarioId);
    }

    return { bytes, tipo: identificarTipoImagem(bytes) };
  })()
    .catch((erro: unknown) => {
      fotoCache.delete(chaveCache);
      throw erro;
    });

  fotoCache.set(chaveCache, requisicao);
  return requisicao;
}

export function invalidarCacheFotoFuncionario(funcionarioId: string) {
  fotoCache.delete(`${funcionarioId}:completa`);
  fotoCache.delete(`${funcionarioId}:miniatura`);
  notificarFotoAtualizada(funcionarioId);
}

export async function atualizarCacheFotoFuncionario(
  funcionarioId: string,
  arquivo: Blob
) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const foto = {
    bytes,
    tipo: arquivo.type || "application/octet-stream",
  };

  fotoCache.set(`${funcionarioId}:completa`, Promise.resolve(foto));
  fotoCache.set(`${funcionarioId}:miniatura`, Promise.resolve(foto));
  notificarFotoAtualizada(funcionarioId);
}

export default function FuncionarioAvatar({
  funcionarioId,
  nome,
  size = "detail",
  fotoUrl: fotoRelativa,
  fotoTimestamp,
}: FuncionarioAvatarProps) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoVersion, setFotoVersion] = useState(0);

  useEffect(() => {
    const handleFotoAtualizada = (event: Event) => {
      if ((event as CustomEvent<string>).detail === funcionarioId) {
        setFotoVersion((version) => version + 1);
      }
    };

    window.addEventListener(FOTO_ATUALIZADA_EVENT, handleFotoAtualizada);
    return () => window.removeEventListener(FOTO_ATUALIZADA_EVENT, handleFotoAtualizada);
  }, [funcionarioId]);

  useEffect(() => {
    let cancelado = false;

    setFotoUrl(null);
    if (!funcionarioId) return;

    if (fotoRelativa?.startsWith("data:")) {
      setFotoUrl(fotoRelativa);
      return;
    }

    const carregar = async () => {
      try {
        const foto = await carregarFotoFuncionario(
          funcionarioId,
          size === "detail"
        );
        if (!foto) return;

        // O contêiner do Power Apps pode bloquear URLs blob:. Data URLs usam
        // o mesmo formato já aceito para a fotografia do usuário no cabeçalho.
        const url = converterBytesParaDataUrl(foto.bytes, foto.tipo);
        if (!cancelado) setFotoUrl(url);
      } catch (erro) {
        console.error("Erro ao carregar fotografia:", erro);
        if (!cancelado) setFotoUrl(null);
      }
    };

    void carregar();

    return () => {
      cancelado = true;
    };
    // Os campos virtuais *_url e *_timestamp nem sempre são materializados
    // pelo runtime do Power Apps. Eles continuam na dependência para refazer a
    // leitura quando mudarem, mas nunca devem impedir o download da imagem.
  }, [funcionarioId, size, fotoVersion, fotoRelativa, fotoTimestamp]);

  const iniciais = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-800 text-white ${
        size === "card" ? "h-16 w-16" : "h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28"
      }`}
    >
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={`Foto de ${nome}`}
          className="h-full w-full object-cover"
          decoding="async"
          onError={() => setFotoUrl(null)}
        />
      ) : (
        <span className={size === "card" ? "text-xl font-semibold" : "text-lg font-semibold"}>
          {iniciais || "?"}
        </span>
      )}
    </div>
  );
}
