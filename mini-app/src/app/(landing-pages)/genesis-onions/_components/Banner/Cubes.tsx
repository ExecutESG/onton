interface CubesProps {
  width?: number;
  height?: number;
  className?: string;
}

const Cubes = ({ width = 109, height = 138, className }: CubesProps) => (
  <img
    src="/fairlGPT3.png"
    alt="Stacked orange cubes"
    width={width}
    height={height}
    className={className}
    loading="lazy"
  />
);

export default Cubes;
