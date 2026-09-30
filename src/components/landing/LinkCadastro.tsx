import { useContext, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IndicacaoContext } from "./indicacao";

// Todo botão de cadastro da landing repassa o código de indicação para
// /cadastro, além de ele já ficar salvo no navegador (salvarCodigoIndicacao)
// — assim a indicação é creditada mesmo que a pessoa navegue pela página
// antes de se cadastrar.
export function LinkCadastro({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const ref = useContext(IndicacaoContext);
  return (
    <Link to="/cadastro" search={ref ? { ref } : {}} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
