const PillSelect = ({ children, className = '', ...props }) => {
  return (
    <select
      className={`h-12 appearance-none rounded-full border-2 border-lavender-20 bg-transparent pl-5 pr-10 text-base font-medium text-cream focus:border-lavender focus:outline-none transition-colors bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%23b1a7d0%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80A8%2C8%2C0%2C0%2C1%2C53.66%2C90.34L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_16px_center] bg-no-repeat ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export default PillSelect
