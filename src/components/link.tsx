import { Link as RouterLink, type LinkProps } from "react-router-dom";
import type { AnchorHTMLAttributes } from "react";

export interface CustomLinkProps extends Omit<LinkProps, "to"> {
  href?: string;
  to?: string;
}

export function Link({ href, to, ...props }: CustomLinkProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <RouterLink to={to || href || ""} {...(props as unknown as Omit<LinkProps, "to">)} />;
}

export default Link;
