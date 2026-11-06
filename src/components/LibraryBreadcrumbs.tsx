import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { libraryLocationPath, type LibraryLocation } from '../core/library-navigation';

interface Props {
  location: LibraryLocation;
  onNavigate: (location: LibraryLocation) => void;
  label?: string;
  className?: string;
}

/** Every displayed ancestor opens its own inventory level. */
export default function LibraryBreadcrumbs({
  location,
  onNavigate,
  label = 'Library path',
  className = 'breadcrumbs',
}: Props) {
  const path = libraryLocationPath(location);
  return (
    <nav className={`${className} library-breadcrumbs`} aria-label={label}>
      {path.map((item, index) => (
        <Fragment key={item.location.level}>
          {index > 0 && (
            <ChevronRight size={13} className="breadcrumb-separator" aria-hidden="true" />
          )}
          <button
            type="button"
            className={index === path.length - 1 ? 'breadcrumb-current' : undefined}
            onClick={() => onNavigate(item.location)}
            title={`Browse ${item.label}`}
          >
            {item.label}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
