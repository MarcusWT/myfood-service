import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/shell/useTheme';

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return <Sonner theme={resolvedTheme} richColors closeButton position="bottom-right" {...props} />;
}

export { Toaster };
