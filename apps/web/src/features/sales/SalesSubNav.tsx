import { NavLink } from 'react-router-dom'

export function SalesSubNav() {
  return (
    <div className="mt-4 flex gap-1 border-b border-gray-200 -mb-px">
      <NavLink
        to="/sales"
        end
        className={({ isActive }) =>
          `pb-3 px-1 mr-3 text-sm font-medium border-b-2 transition-colors ${
            isActive
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }
      >
        Pipeline
      </NavLink>
      <NavLink
        to="/sales/templates"
        className={({ isActive }) =>
          `pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            isActive
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }
      >
        Templates
      </NavLink>
    </div>
  )
}
